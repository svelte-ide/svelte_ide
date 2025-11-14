<script>
  import { modalService, MODAL_CANCELLED_BY_X } from '@svelte-ide/core/ModalService.svelte.js'

  let modalElement = $state(null)

  function handleEscape(event) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      modalService.close(MODAL_CANCELLED_BY_X)
    }
  }

  function focusModal() {
    if (!modalElement) return
    modalElement.focus()
  }

  $effect(() => {
    if (modalService.isVisible) {
      requestAnimationFrame(focusModal)
    }
  })
</script>

{#if modalService.isVisible}
  <div
    class="modal-overlay"
    role="presentation"
    tabindex="-1"
    aria-hidden="true"
    onclick={() => modalService.close(MODAL_CANCELLED_BY_X)}
  >
    <div
      class="modal-container"
      role="dialog"
      aria-modal="true"
      aria-label={modalService.question || 'Confirmation'}
      tabindex="-1"
      bind:this={modalElement}
      onclick={(event) => event.stopPropagation()}
      onkeydown={handleEscape}
    >
      <button
        class="modal-close"
        type="button"
        aria-label="Annuler"
        onclick={() => modalService.close(MODAL_CANCELLED_BY_X)}
      >
        ×
      </button>

      <div class="modal-body">
        <div class="modal-question">
          {#if modalService.icon}
            <span class="modal-icon" aria-hidden="true">{modalService.icon}</span>
          {/if}
          <div class="modal-texts">
            <h2 class="modal-title">{modalService.question}</h2>
            {#if modalService.description}
              <p class="modal-description">{modalService.description}</p>
            {/if}
          </div>
        </div>
      </div>

      <div class="modal-actions">
        {#if modalService.buttons.length === 0}
          <span class="modal-hint">Utilisez le bouton × pour annuler.</span>
        {:else}
          {#each modalService.buttons as button}
            <button
              type="button"
              class="modal-button"
              onclick={() => modalService.closeWithAction(button.id, button.payload)}
            >
              {button.label}
            </button>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20000;
    padding: 24px;
  }

  .modal-container {
    position: relative;
    background: #2d2d30;
    color: #cccccc;
    border: 1px solid #3e3e42;
    border-radius: 8px;
    max-width: 420px;
    width: 100%;
    padding: 24px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
    outline: none;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .modal-close {
    position: absolute;
    top: 12px;
    right: 12px;
    background: transparent;
    border: none;
    color: #cccccc;
    font-size: 18px;
    cursor: pointer;
    line-height: 1;
    padding: 4px;
    border-radius: 3px;
  }

  .modal-close:hover,
  .modal-close:focus-visible {
    background: #3e3e42;
    outline: none;
  }

  .modal-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .modal-question {
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }

  .modal-icon {
    font-size: 28px;
    line-height: 1;
  }

  .modal-texts {
    flex: 1;
  }

  .modal-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #ffffff;
  }

  .modal-description {
    margin: 8px 0 0 0;
    font-size: 13px;
    line-height: 1.5;
    color: #cccccc;
  }

  .modal-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    align-items: center;
  }

  .modal-button {
    background: #3e3e42;
    color: #ffffff;
    border: 1px solid #5a5a5a;
    border-radius: 4px;
    padding: 8px 16px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
  }

  .modal-button:hover,
  .modal-button:focus-visible {
    background: #0e639c;
    border-color: #0e639c;
    outline: none;
  }

  .modal-hint {
    font-size: 12px;
    color: #999999;
    margin-right: auto;
  }
</style>
