<script>
  let { content = "allo bonjour" } = $props()
</script>

<div class="file-content">
  <div class="content-body">
    <pre>{content}</pre>
  </div>
</div>

<style>
  .file-content {
    height: 100%;
    background: #1e1e1e;
    color: #cccccc;
    display: flex;
    flex-direction: column;
  }

  .content-header {
    background: #2d2d30;
    border-bottom: 1px solid #3e3e42;
    padding: 8px 12px;
  }

  .content-header h3 {
    font-size: 13px;
    font-weight: 400;
    margin: 0;
    color: #cccccc;
  }

  .content-body {
    flex: 1;
    padding: 12px;
    overflow: auto;
  }

  pre {
    font-family: 'Courier New', monospace;
    font-size: 14px;
    line-height: 1.5;
    color: #cccccc;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
</style>
