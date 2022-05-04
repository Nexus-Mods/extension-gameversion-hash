import crypto from 'crypto';
import path from 'path';
import { fs, log, types, selectors, util } from 'vortex-api';

import sessionReducer from './reducers/session';

import { getUserFacingVersion } from './hashMapper';

import { GameVersionProviderFunc, GameVersionProviderTest, IHashEntry, IHashingDetails } from './types/types';

import { setShowHashDialog } from './actions/session';
import FileHashingDialog from './views/FileHashingDialog';
import { DEBUG_MODE, HASHMAP_LOCAL_PATH, TEMP_PATH, WD_NAME } from './constants';
import { hashMapFromFile } from './hashMapper';

import { generate } from 'shortid';

async function generateHash(filePath: string): Promise<string> {
  const hash = crypto.createHash('md5');
  const fileData = await fs.readFileAsync(filePath);
  const buf = hash
    .update(fileData)
    .digest();
  return buf.toString('hex');
}

async function queryPath(filePath: string): Promise<{ exists: boolean, isFile: boolean }> {
  try {
    const stats = await fs.statAsync(filePath);
    const isFile = !stats.isDirectory();
    return Promise.resolve({ exists: true, isFile });
  } catch (err) {
    return Promise.resolve({ exists: false, isFile: false });
  }
}

function isGameValid(game: types.IGame, discovery: types.IDiscoveryResult): boolean {
  return (!!discovery?.path && !!game?.executable);
}

async function testViability(game: types.IGame,
                             discovery: types.IDiscoveryResult): Promise<boolean> {
  if (!isGameValid(game, discovery)) {
    return false;
  }

  const details: IHashingDetails = game.details;
  if (details.ignoreHashing === true) {
    return false;
  }
  if (details?.hashDirPath) {
    if (!path.isAbsolute(details.hashDirPath)) {
      details.hashDirPath = path.join(discovery.path, details.hashDirPath);
    }

    const pathInfo = await queryPath(details.hashDirPath);
    if (pathInfo.exists && !pathInfo.isFile) {
      return true;
    }
  }

  if (details?.hashFiles) {
    if (!Array.isArray(details.hashFiles)) {
      details.hashFiles = [details.hashFiles];
    }

    for (let filePath of details.hashFiles) {
      if (!path.isAbsolute(filePath)) {
        filePath = path.join(discovery.path, filePath);
      }
      const filePathInfo = await queryPath(filePath);
      if (!filePathInfo.isFile) {
        log('warn', 'details.files should only contain filepaths, not directories', filePath);
        return false;
      }
      if (filePathInfo.exists) {
        log('warn', 'required file for game version hashing is missing', filePath);
        return false;
      }
    }

    return true;
  }

  const filePaths = game.requiredFiles.map(file => path.join(discovery.path, file));
  for (const filePath of filePaths) {
    try {
      await fs.statAsync(filePath);
    } catch (err) {
      return false;
    }
  }
  return true;
}

async function getHashVersion(api: types.IExtensionApi,
                              game: types.IGame,
                              discovery: types.IDiscoveryResult): Promise<string> {
  if (!isGameValid(game, discovery)) {
    return Promise.reject(new Error('Game is not discovered'));
  }
  const details: IHashingDetails = game.details;
  const szip: util.SevenZip = new util.SevenZip();
  const archiveDestination = path.join(TEMP_PATH, generate() + 'hash.7z');
  try {
    // Just in case.
    await fs.removeAsync(archiveDestination);
  } catch (err) {
    // nop
  }
  const hashPath = details?.hashDirPath
    ? path.isAbsolute(details.hashDirPath)
      ? details.hashDirPath
      : path.join(discovery.path, details.hashDirPath)
    : undefined;
  const files = (details?.hashFiles)
    ? details.hashFiles
    : hashPath
      ? (await fs.readdirAsync(hashPath))
        .map(file => path.join(hashPath, file))
        .filter(async filePath => (await queryPath(filePath)).isFile)
      : game.requiredFiles;
  if (files) {
    const filePaths = files.map(file =>
      path.isAbsolute(file) ? file : path.join(discovery.path, file));
    try {
      await szip.add(archiveDestination, filePaths);
    } catch (err) {
      await fs.removeAsync(archiveDestination);
    }
    const hash = await generateHash(archiveDestination);
    await fs.removeAsync(archiveDestination);
    return getUserFacingVersion(api, hash);
  }
}

function main(context: types.IExtensionContext) {
  context.registerReducer(['session', 'gameversion_hashmap'], sessionReducer);
  const testFunc: GameVersionProviderTest = testViability;
  const getGameVersionFunc: GameVersionProviderFunc = getHashVersion;
  context?.['registerGameVersionProvider']('hash-version-check', 125, testFunc,
    (game, discovery) => getGameVersionFunc(context.api, game, discovery));

  context.registerAPI('getHashVersion', (game: types.IGame,
                                         discovery: types.IDiscoveryResult,
                                         cb: (err: Error, version: string) => string) => {
    if (discovery?.path === undefined || game === undefined) {
      return;
    }
    getGameVersionFunc(context.api, game, discovery)
      .then(ver => cb(null, ver))
      .catch(err => cb(err, null));

  }, { minArguments: 3 });

  context.registerDialog('file-hashing-dialog', FileHashingDialog, () => ({
    onGenerateHashingEntry: async (filePaths: string[]) => {
      context.api.sendNotification({
        type: 'activity',
        message: 'Generating hash',
        id: 'generating-hash-notif',
        allowSuppress: false,
        noDismiss: true,
      });
      const archiveDestination = path.join(TEMP_PATH, generate() + 'hash.7z');
      const szip: util.SevenZip = new util.SevenZip();
      try {
        // Just in case.
        await fs.removeAsync(archiveDestination);
      } catch (err) {
        // nop
      }
      try {
        await szip.add(archiveDestination, filePaths);
      } catch (err) {
        await fs.removeAsync(archiveDestination);
      }
      const hash = await generateHash(archiveDestination);
      await fs.removeAsync(archiveDestination);
      const state = context.api.getState();
      const gameId = selectors.activeGameId(state);
      const res = await context.api.showDialog('info', 'Enter Hash Entry Values', {
        text: 'Insert below information',
        input: [
          { id: 'gameId', label: 'GameId', type: 'text', value: gameId },
          { id: 'userFacingVersion', label: 'User Facing Version', type: 'text' },
          { id: 'variant', label: 'Variant (game store)', type: 'text' },
        ],
        checkboxes: [
          { id: 'openFileLocation', value: false, text: 'Open File Location' },
        ]
      },
      [ { label: 'Cancel' }, { label: 'Save' } ]);
      if (res.action === 'Save') {
        try {
          const discovery = selectors.discoveryByGame(state, res.input['gameId']);
          if (!discovery?.path) {
            throw new util.ProcessCanceled('Game is not discovered', res.input['gameId']);
          }
          const entry: IHashEntry = {
            files: filePaths.map(file => path.relative(discovery.path, file)),
            hashValue: hash,
            userFacingVersion: res.input['userFacingVersion'],
            variant: res.input['variant'],
          }
          const data = await hashMapFromFile();
          data[res.input['gameId']][entry.hashValue] = entry;
          await util.writeFileAtomic(HASHMAP_LOCAL_PATH, JSON.stringify(data, undefined, 2));
          if (res.input['openFileLocation']) {
            util.opn(path.dirname(HASHMAP_LOCAL_PATH)).catch(err => null);
          }
        } catch (err) {
          context.api.showErrorNotification('Failed to save hash entry', err, { allowReport: false });
        }
      }

      context.api.dismissNotification('generating-hash-notif');
    }
  }));

  context.registerAction('mod-icons', 300, 'settings', {}, 'Generate Hash Entry', () => {
    context.api.store.dispatch(setShowHashDialog(true));
  }, () => DEBUG_MODE);
  context.once(() => {
    const wdPath = path.join(TEMP_PATH, WD_NAME);
    if (DEBUG_MODE) {
      const git = require('simple-git/promise');
      const gitBootstrap = git();
      gitBootstrap.clone('https://github.com/Nexus-Mods/Vortex.git', wdPath, ['--single-branch', '--branch', 'announcements'])
        .catch(err => err.message.includes('already exists')
          ? git(wdPath).pull()
          : Promise.reject(err));
    }
  });
  return true;
}

module.exports = {
  default: main,
};
