<template>
  <div id="app">
    <router-view/>
  </div>
</template>

<script>
import "./typo.css"
export default {
  name: 'app'
}
</script>

<style lang="stylus">
body, #app
  height: 100vh
  width: 100vw
  margin: 0
  padding: 0
  overflow: hidden
</style>
