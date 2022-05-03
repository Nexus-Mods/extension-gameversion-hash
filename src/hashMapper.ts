import https from 'https';
import path from 'path';
import url from 'url';
import { setGameVersionHashMap } from './actions/session';
import { IHashEntry, IHashMap } from './types/types';

import { fs, selectors, types, util } from 'vortex-api';

const HASHMAP_FILENAME = 'gameversion_hashmap.json';
const HASHMAP_LINK =
  `https://raw.githubusercontent.com/Nexus-Mods/Vortex/announcements/${HASHMAP_FILENAME}`;

const DEBUG_MODE: boolean = false;
const HASHMAP_LOCAL_PATH = path.join(__dirname, HASHMAP_FILENAME);
export async function hashMapFromFile() {
  const data = await fs.readFileAsync(HASHMAP_LOCAL_PATH);
  try {
    const parsed: IHashMap = JSON.parse(data);
    return parsed;
  } catch (err) {
    return Promise.reject(err);
  }
}

export function getHTTPData(link: string): Promise<IHashMap> {
  const sanitizedURL = url.parse(link);
  return new Promise((resolve, reject) => {
    https.get(sanitizedURL.href, res => {
      res.setEncoding('utf-8');
      let output = '';
      res
        .on('data', (data) => output += data)
        .on('end', () => {
          try {
            const parsed: IHashMap = JSON.parse(output);
            return resolve(parsed);
          } catch (err) {
            return reject(err);
          }
      });
    }).on('error', (e) => {
      return reject(e);
    }).end();
  });
}

export async function getUserFacingVersion(api: types.IExtensionApi, hash: string) {
  const state = api.getState();
  const gameId = selectors.activeGameId(state);
  let gameHashMap = util.getSafe(state, ['session', 'gameversion_hashmap', gameId], undefined);
  if (!gameHashMap) {
    gameHashMap = await updateHashMap(api, gameId);
  }
  const hashEntry: IHashEntry = gameHashMap?.[hash];
  return (hashEntry)
    ? hashEntry.userFacingVersion
    : hash;
}

export async function updateHashMap(api: types.IExtensionApi, gameId: string) {
  try {
    const hashMap = (DEBUG_MODE)
      ? await hashMapFromFile()
      : await getHTTPData(HASHMAP_LINK);
    const data: { [hash: string]: IHashEntry } = hashMap[gameId];
    api.store.dispatch(setGameVersionHashMap(gameId, data));
    return data;
  } catch (err) {
    return undefined;
  }
}
