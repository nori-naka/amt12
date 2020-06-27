<template>
  <button
    v-on:click="trackBtnClick"
    class="circleBtn"
    v-bind:class="show_track ? 'circleBtnSelected' : null"
  >
    <img src="../../assets/track_icon.png" />
  </button>
</template>

<script>
import { trackLayerModule } from "./index.js";

export default {
  data() {
    return {
      show_track: false
    };
  },
  methods: {
    trackBtnClick() {
      this.show_track = !this.show_track;
      // this.$store.state.show_track = this.show_track;
      this.trackLayer.setVisible(this.show_track);
    }
  },
  mounted() {
    // this.trackLayer = trackLayerModule(
    //   this.$store.state.map,
    //   () => this.$store.state.users,
    //   this.$store.state.myId,
    //   this.$store.state.activeId,
    //   this.$store.state.socketio,
    //   this.$store.state.logger
    // );
    // this.trackLayer.add();
    // this.trackLayer.setActive(false);
    // this.trackLayer.setVisible(false);
  },
  beforeDestroy() {
    this.trackLayer.remove();
  }
};
</script>
<style>
.circleBtn {
  width: 4rem;
  height: 4rem;
  background: #37a3c0;
  border: none;
  border-radius: 5rem;
  -moz-border-radius: 5rem;
  -webkit-border-radius: 5rem;
  color: white;
  outline: none !important;
  transition: background-color, color 0.3s ease-in;
  user-select: none;
}
</style>
