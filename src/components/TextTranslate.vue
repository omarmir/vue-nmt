<template>
  <div class="flex flex-col w-full gap-4">
    <TextArea name="english" placeholder="Type in your english content here">
      <template #label> English </template>
    </TextArea>
    <PrimaryButton class="w-full"> Translate </PrimaryButton>
    <TextArea name="french" placeholder="Your french content will output here" :disabled="true">
      <template #label> French </template>
    </TextArea>
  </div>
</template>
<script lang="ts" setup>
import PrimaryButton from './Inputs/PrimaryButton.vue'
import TextArea from './Inputs/TextArea.vue'
</script>
