<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { user, connectSocket } from '$lib/stores/socket';
  import Icon from '$lib/components/Icon.svelte';

  let mode: 'welcome' | 'login' | 'register' | 'guest' = 'welcome';
  let email = '';
  let username = '';
  let guestName = '';
  let loading = false;
  let message = '';
  let error = '';

  onMount(async () => {
    // First, check for guest user in localStorage
    const storedGuest = localStorage.getItem('guestUser');
    if (storedGuest) {
      try {
        const guestUser = JSON.parse(storedGuest);
        if (guestUser.isGuest) {
          user.set(guestUser);
          connectSocket(guestUser);
          goto('/lobby');
          return;
        }
      } catch (e) {
        localStorage.removeItem('guestUser');
      }
    }

    // Check if logged in via session cookie
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.user) {
        user.set(data.user);
        connectSocket(data.user);
        goto('/lobby');
      }
    } catch (e) {
      console.error('Auth check failed:', e);
    }
  });

  async function handleLogin() {
    if (!email) return;
    loading = true;
    error = '';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();

      if (data.error) {
        error = data.error;
      } else {
        message = data.message;
      }
    } catch (e) {
      error = 'Failed to send login link';
    }
    loading = false;
  }

  async function handleRegister() {
    if (!email || !username) return;
    loading = true;
    error = '';

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username })
      });
      const data = await res.json();

      if (data.error) {
        error = data.error;
      } else {
        message = data.message;
      }
    } catch (e) {
      error = 'Registration failed';
    }
    loading = false;
  }

  async function handleGuest() {
    if (!guestName || guestName.length < 2) return;
    loading = true;
    error = '';

    try {
      const res = await fetch('/api/auth/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: guestName })
      });
      const data = await res.json();

      if (!res.ok) {
        error = data.error || 'Failed to create guest account';
        loading = false;
        return;
      }

      if (data.user) {
        // Store guest in localStorage for session persistence
        localStorage.setItem('guestUser', JSON.stringify(data.user));
        user.set(data.user);
        connectSocket(data.user);
        goto('/lobby');
      }
    } catch (e) {
      console.error('Guest creation error:', e);
      error = 'Failed to create guest account';
    }
    loading = false;
  }
</script>

<svelte:head>
  <title>Big Two - Multiplayer Chinese Poker</title>
</svelte:head>

<div class="container">
  <!-- Background effects -->
  <div class="bg-effects">
    <div class="glow-orb orb-1"></div>
    <div class="glow-orb orb-2"></div>
    <div class="glow-orb orb-3"></div>
  </div>

  <div class="hero">
    <div class="logo">
      <div class="logo-icon">
        <Icon name="playing-cards" size={48} />
      </div>
      <h1>Big Two</h1>
    </div>
    <p class="tagline">Multiplayer Chinese Poker</p>
  </div>

  <div class="card-container auth-card animate-slide-up">
    {#if message}
      <div class="success-message">
        <div class="success-icon">
          <Icon name="mail-check" size={48} />
        </div>
        <p>{message}</p>
        <button class="btn btn-secondary" on:click={() => { message = ''; mode = 'welcome'; }}>
          <Icon name="arrow-left" size="sm" />
          Back
        </button>
      </div>
    {:else if mode === 'welcome'}
      <h2>Welcome!</h2>
      <p class="text-muted mb-3">Choose how you'd like to play</p>

      <div class="auth-options">
        <button class="btn btn-primary w-full" on:click={() => mode = 'login'}>
          <Icon name="key" size="sm" />
          Login with Email
        </button>
        <button class="btn btn-secondary w-full" on:click={() => mode = 'register'}>
          <Icon name="sparkles" size="sm" />
          Create Account
        </button>
        <div class="divider">
          <span>or</span>
        </div>
        <button class="btn btn-secondary w-full" on:click={() => mode = 'guest'}>
          <Icon name="user" size="sm" />
          Play as Guest
        </button>
      </div>
    {:else if mode === 'login'}
      <button class="back-btn" on:click={() => mode = 'welcome'}>
        <Icon name="chevron-left" size="sm" />
        Back
      </button>
      <h2>Login</h2>
      <p class="text-muted mb-3">We'll send you a magic link</p>

      {#if error}<p class="error"><Icon name="alert-circle" size="sm" /> {error}</p>{/if}

      <form on:submit|preventDefault={handleLogin}>
        <input
          type="email"
          bind:value={email}
          placeholder="Enter your email"
          required
          class="w-full mb-2"
        />
        <button class="btn btn-primary w-full" disabled={loading}>
          {#if loading}
            <Icon name="loader" size="sm" class="spin" />
            Sending...
          {:else}
            <Icon name="send" size="sm" />
            Send Login Link
          {/if}
        </button>
      </form>
    {:else if mode === 'register'}
      <button class="back-btn" on:click={() => mode = 'welcome'}>
        <Icon name="chevron-left" size="sm" />
        Back
      </button>
      <h2>Create Account</h2>
      <p class="text-muted mb-3">Join the game!</p>

      {#if error}<p class="error"><Icon name="alert-circle" size="sm" /> {error}</p>{/if}

      <form on:submit|preventDefault={handleRegister}>
        <input
          type="text"
          bind:value={username}
          placeholder="Choose a username"
          required
          class="w-full mb-2"
          minlength="2"
          maxlength="20"
        />
        <input
          type="email"
          bind:value={email}
          placeholder="Enter your email"
          required
          class="w-full mb-2"
        />
        <button class="btn btn-primary w-full" disabled={loading}>
          {#if loading}
            <Icon name="loader" size="sm" class="spin" />
            Creating...
          {:else}
            <Icon name="user-plus" size="sm" />
            Create Account
          {/if}
        </button>
      </form>
    {:else if mode === 'guest'}
      <button class="back-btn" on:click={() => mode = 'welcome'}>
        <Icon name="chevron-left" size="sm" />
        Back
      </button>
      <h2>Play as Guest</h2>
      <p class="text-muted mb-3">No account needed!</p>

      {#if error}<p class="error"><Icon name="alert-circle" size="sm" /> {error}</p>{/if}

      <form on:submit|preventDefault={handleGuest}>
        <input
          type="text"
          bind:value={guestName}
          placeholder="Enter your name"
          required
          class="w-full mb-2"
          minlength="2"
          maxlength="20"
        />
        <button class="btn btn-gold w-full" disabled={loading}>
          {#if loading}
            <Icon name="loader" size="sm" class="spin" />
            Joining...
          {:else}
            <Icon name="door-enter" size="sm" />
            Join Lobby
          {/if}
        </button>
      </form>
      <p class="text-muted mt-2 guest-note">
        <Icon name="info-circle" size="sm" />
        Guest stats won't be saved to the leaderboard
      </p>
    {/if}
  </div>
</div>

<style>
  .container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    position: relative;
    overflow: hidden;
    background:
      radial-gradient(ellipse at 50% 0%, rgba(99, 102, 241, 0.15) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 80%, rgba(139, 92, 246, 0.1) 0%, transparent 40%),
      radial-gradient(ellipse at 20% 60%, rgba(99, 102, 241, 0.08) 0%, transparent 40%),
      linear-gradient(180deg, var(--bg-darkest) 0%, var(--bg-darker) 100%);
  }

  /* Background glow effects */
  .bg-effects {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .glow-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.4;
    animation: float 20s ease-in-out infinite;
  }

  .orb-1 {
    width: 400px;
    height: 400px;
    background: var(--accent-primary);
    top: -100px;
    left: -100px;
    animation-delay: 0s;
  }

  .orb-2 {
    width: 300px;
    height: 300px;
    background: var(--accent-secondary);
    bottom: -50px;
    right: -50px;
    animation-delay: -7s;
  }

  .orb-3 {
    width: 250px;
    height: 250px;
    background: var(--gold);
    top: 50%;
    left: 60%;
    opacity: 0.2;
    animation-delay: -14s;
  }

  @keyframes float {
    0%, 100% { transform: translate(0, 0) scale(1); }
    25% { transform: translate(30px, -30px) scale(1.1); }
    50% { transform: translate(-20px, 20px) scale(0.95); }
    75% { transform: translate(40px, 10px) scale(1.05); }
  }

  .hero {
    text-align: center;
    margin-bottom: 40px;
    position: relative;
    z-index: 1;
  }

  .logo {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-bottom: 12px;
  }

  .logo-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
    border-radius: 16px;
    color: white;
    box-shadow:
      0 8px 32px rgba(99, 102, 241, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }

  .logo h1 {
    font-size: 3rem;
    letter-spacing: 2px;
  }

  .tagline {
    color: var(--text-secondary);
    font-size: 1.1rem;
    font-weight: 500;
  }

  .auth-card {
    width: 100%;
    max-width: 400px;
    position: relative;
    z-index: 1;
  }

  .auth-card h2 {
    text-align: center;
    margin-bottom: 8px;
    font-size: 1.25rem;
  }

  .auth-options {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 0.875rem;
    margin-bottom: 16px;
    padding: 0;
    transition: color 0.2s;
  }

  .back-btn:hover {
    color: var(--text-primary);
  }

  .error {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--danger);
    background: var(--danger-glow);
    padding: 12px 16px;
    border-radius: 10px;
    margin-bottom: 16px;
    font-size: 0.875rem;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .success-message {
    text-align: center;
    padding: 20px;
  }

  .success-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
    background: var(--success-glow);
    border-radius: 50%;
    color: var(--success);
    margin-bottom: 20px;
  }

  .success-message p {
    color: var(--text-secondary);
    margin-bottom: 24px;
    font-size: 0.95rem;
  }

  .guest-note {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 0.8rem !important;
  }

  /* Spinner animation */
  :global(.spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Mobile adjustments */
  @media (max-width: 480px) {
    .logo h1 {
      font-size: 2.25rem;
    }

    .logo-icon {
      width: 56px;
      height: 56px;
    }

    .logo-icon :global(.icon) {
      width: 32px;
      height: 32px;
    }

    .auth-card {
      padding: 24px 20px;
    }
  }
</style>
