import path from 'path';
import { util } from 'vortex-api';

export const HASHMAP_FILENAME = 'gameversion_hashmap.json';
export const HASHMAP_LINK =
  `https://raw.githubusercontent.com/Nexus-Mods/Vortex/announcements/${HASHMAP_FILENAME}`;

export const DEBUG_MODE: boolean = false;
export const WD_NAME = 'vortex_announcements';
export const TEMP_PATH = path.join(util.getVortexPath('temp'), 'gameversion_hash');
export const HASHMAP_LOCAL_PATH = path.join(TEMP_PATH, WD_NAME, HASHMAP_FILENAME);
