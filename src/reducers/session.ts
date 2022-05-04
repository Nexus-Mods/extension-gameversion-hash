import { types, util } from 'vortex-api';

import * as actions from '../actions/session';

const sessionReducer: types.IReducerSpec = {
  reducers: {
    [actions.setGameVersionHashMap as any]: (state, payload) => {
      const { gameId, hashMap } = payload;
      return util.setSafe(state, [gameId], hashMap);
    },
    [actions.setShowHashDialog as any]: (state, payload) => {
      const { show } = payload;
      return util.setSafe(state, ['showDialog'], show);
    },
  },
  defaults: {
    showDialog: false,
  },
};

export default sessionReducer;
