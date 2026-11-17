<script setup lang="ts">
defineProps<{ active: boolean; speaking: boolean }>()

const paths = Array.from({ length: 18 }, (_, index) => {
  const spread = index - 8.5
  const amplitude = 36 + Math.abs(spread) * 3.2
  const offset = spread * 2.7
  return `M 5 ${108 + offset} C 88 ${108 + offset}, 102 ${108 + offset + amplitude}, 178 ${108 + offset} S 263 ${108 + offset - amplitude * 1.85}, 344 ${108 + offset} S 424 ${108 + offset + amplitude * 0.75}, 515 ${108 + offset}`
})
</script>

<template>
  <div class="wave-wrap" :class="{ 'wave-active': active, 'wave-speaking': speaking }" aria-hidden="true">
    <div class="wave-halo" />
    <svg class="wave-art" viewBox="0 0 520 220" preserveAspectRatio="xMidYMid meet">
      <path v-for="(path, index) in paths" :key="index" :d="path" fill="none" stroke="#27b7ac" stroke-width="0.9" :opacity="0.22 + index * 0.028" />
    </svg>
  </div>
</template>
