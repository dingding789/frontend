<template>
  <!-- 整个组件的容器，固定在页面上，背景为深灰色，文本颜色为浅灰色 -->
  <div class="fixed inset-0 flex flex-col bg-gray-800 text-gray-200">
    <!-- 命令栏，高度为12单位，背景为更深的灰色，居中对齐，带有阴影和内边距 -->
    <div class="h-12 bg-gray-900 flex items-center px-4 shadow-md space-x-2">
      <!-- 命令栏组件，监听add-line事件，当该事件触发时，将showModal设置为true以显示模态框 -->
      <CommandBar /> <!-- <CommandBar @add-line="showModal = true" /> -->
      <!-- 占位符，使命令栏中的其他元素向右对齐 -->
      <div class="flex-1"></div>
    </div>

    <!-- 主体容器，分为左右两部分，左侧为列表，右侧为3D视图 -->
    <div class="flex flex-1 overflow-hidden">
      <!-- 左侧容器，宽度为60单位，背景为更深的灰色，右侧有边框，内边距为2单位，内容可滚动 -->
      <div class="w-60 bg-gray-900 border-r border-gray-700 p-2 overflow-auto">
        <!-- 线条列表组件，接收lines数据，监听update-lines事件以更新线条 -->
        <!-- <LineList :lines="lines" @update-lines="updateLines" /> -->
         <List/>
      </div>
      <!-- 右侧容器，占据剩余空间，背景为黑色，内容可滚动，设置为相对定位以便子组件定位 -->
      <div class="flex-1 bg-black relative overflow-hidden">
        <!-- 3D视图组件，接收lines数据以进行渲染 -->
        <ThreeViewer />
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import List from 'D:/Desktop/Project/geometry-service/src/ui/panels/List.vue'; // 导入 List 组件
import ThreeViewer from './ui/viewport/ThreeViewer.vue'; // 导入 ThreeViewer 组件
import CommandBar from './ui/layout/CommandBar.vue';
</script>
