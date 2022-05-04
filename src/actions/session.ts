import { createAction } from 'redux-act';
import { IHashEntry } from '../types/types';

export const setGameVersionHashMap = createAction('SET_GAMEVERSION_HASHMAP',
    (gameMode: string, hashMap: { [hash: string]: IHashEntry }) => ({ gameMode, hashMap }));

export const setShowHashDialog = createAction('SET_SHOW_HASH_DIALOG',
    (show: boolean) => ({ show }));
