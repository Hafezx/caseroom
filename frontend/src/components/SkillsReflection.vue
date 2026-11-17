<script setup lang="ts">
const skills = [
  { title: 'Listening and questioning', prompt: 'Which open questions helped Maya explain the delay? What facts did you still need to ask about?' },
  { title: 'Clear communication', prompt: 'Find where you explained the next steps. Could you say them more plainly?' },
  { title: 'Professionalism', prompt: 'Did you acknowledge what you could not yet confirm, without promising an outcome?' },
  { title: 'Client focus', prompt: 'Did you address Maya’s six-week tenancy deadline and ask what matters most to her?' },
  { title: 'Trust and rapport', prompt: 'How did you show Maya you heard her concern and agree when you would follow up?' },
]
</script>

<template>
  <section class="surface skills-panel" aria-labelledby="skills-heading">
    <h2 id="skills-heading">Skills reflection</h2>
    <p class="skills-intro">Use your transcript to review these interview skills. This is guidance for practice, not a score.</p>
    <div v-for="skill in skills" :key="skill.title" class="skill-item">
      <h3>{{ skill.title }}</h3>
      <p>{{ skill.prompt }}</p>
    </div>
  </section>
</template>
