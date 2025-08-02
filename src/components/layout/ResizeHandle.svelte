<script>
  let { direction = 'vertical', onResizeStart = () => {} } = $props()
</script>

<div
  class="resize-handle"
  class:vertical={direction === 'vertical'}
  class:horizontal={direction === 'horizontal'}
  onmousedown={onResizeStart}
  role="separator"
></div>

<style>
  .resize-handle {
    background: transparent;
    transition: background-color 0.2s;
    flex-shrink: 0;
  }

  .resize-handle:hover {
    background: #007acc;
  }

  .vertical {
    width: 1px;
    cursor: ew-resize;
    height: 100%;
  }

  .horizontal {
    height: 1px;
    cursor: ns-resize;
    width: 100%;
  }
</style>
