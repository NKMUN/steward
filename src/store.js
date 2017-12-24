import Vue from 'vue'
import Vuex from 'vuex'
import persistence from 'store'
import jwtDecode from 'jwt-decode'

Vue.use(Vuex)

function checkToken(token) {
  try{
    if (!token) return false

    const payload = jwtDecode(token)

    // check expires
    if (payload.exp < Date.now() / 1000) return false

    return true
  }catch(e) {
    return false
  }
}

const PERSISTENCE_TOKEN_KEY = 'user/token'

export default new Vuex.Store({
  state: () => ({
    token: persistence.get(PERSISTENCE_TOKEN_KEY)
  }),
  mutations: {
    token(state, value) {
      state.token = value
      if (value)
        persistence.set(PERSISTENCE_TOKEN_KEY, value)
      else
        persistence.remove(PERSISTENCE_TOKEN_KEY)
    }
  },
  getters: {
    token: state => checkToken(state.token) ? state.token : null,
    org: state => {
      if (!state.token) return null
      const payload = jwtDecode(state.token)
      return payload.org
    },
    identifier: state => {
      if (!state.token) return null
      const payload = jwtDecode(state.token)
      return payload.identifier
    },
    expires: state => {
      if (!state.token) return null
      const payload = jwtDecode(state.token)
      return new Date(payload.exp * 1000)
    }
  }
})