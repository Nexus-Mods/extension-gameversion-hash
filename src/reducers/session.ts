import { types, util } from 'vortex-api';

import * as actions from '../actions/session';

const sessionReducer: types.IReducerSpec = {
  reducers: {
    [actions.setGameVersionHashMap as any]: (state, payload) => {
      const { gameId, hashMap } = payload;
      return util.setSafe(state, [gameId], hashMap);
    },
  },
  defaults: {},
};

export default sessionReducer;
