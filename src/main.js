import Vue from 'vue'
import App from './App'
import router from './router'
import localforage from 'localforage'
import superagent from 'superagent'
import superagentUse from 'superagent-use'
import Icon from 'vue-awesome/components/Icon'

Vue.config.productionTip = false

Vue.component('Icon', Icon)
Vue.prototype.$agent = superagentUse(superagent)
Vue.prototype.$agent.use(req => {
  // TOOD: in dev, no token
  // const token = store.getters['user/token']
  // token && req.auth(token, null, {type: 'bearer'})
})
Vue.prototype.$agent.use(req => {
  req.body = () => new Promise((resolve, reject) =>
      req.then(
          res => resolve(res.body),
          reject
      )
  )
  req.blob = () => req.responseType('blob').body()
})

/* eslint-disable no-new */
new Vue({
  el: '#app',
  router,
  render: h => h(App)
})
