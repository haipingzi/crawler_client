<template>
  <ImageFetcher />
</template>

<script>
import ImageFetcher from "./components/ImageFetcher.vue";

export default {
  name: "App",
  components: {
    ImageFetcher,
  },
};
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 20px;
}
</style>
