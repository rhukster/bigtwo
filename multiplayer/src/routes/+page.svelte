<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { user, connectSocket } from '$lib/stores/socket';

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
  <title>Big Two - Multiplayer</title>
</svelte:head>

<div class="container">
  <div class="hero">
    <div class="logo">
      <span class="logo-icon">🎴</span>
      <h1>Big Two</h1>
    </div>
    <p class="tagline">Multiplayer Chinese Poker</p>
  </div>

  <div class="card-container auth-card">
    {#if message}
      <div class="success-message">
        <span>✉️</span>
        <p>{message}</p>
        <button class="btn btn-secondary" on:click={() => { message = ''; mode = 'welcome'; }}>
          Back
        </button>
      </div>
    {:else if mode === 'welcome'}
      <h2>Welcome!</h2>
      <p class="text-muted mb-3">Choose how you'd like to play</p>

      <div class="auth-options">
        <button class="btn btn-primary w-full" on:click={() => mode = 'login'}>
          🔑 Login with Email
        </button>
        <button class="btn btn-secondary w-full" on:click={() => mode = 'register'}>
          ✨ Create Account
        </button>
        <div class="divider">
          <span>or</span>
        </div>
        <button class="btn btn-secondary w-full" on:click={() => mode = 'guest'}>
          👤 Play as Guest
        </button>
      </div>
    {:else if mode === 'login'}
      <button class="back-btn" on:click={() => mode = 'welcome'}>← Back</button>
      <h2>Login</h2>
      <p class="text-muted mb-3">We'll send you a magic link</p>

      {#if error}<p class="error">{error}</p>{/if}

      <form on:submit|preventDefault={handleLogin}>
        <input
          type="email"
          bind:value={email}
          placeholder="Enter your email"
          required
          class="w-full mb-2"
        />
        <button class="btn btn-primary w-full" disabled={loading}>
          {loading ? 'Sending...' : 'Send Login Link'}
        </button>
      </form>
    {:else if mode === 'register'}
      <button class="back-btn" on:click={() => mode = 'welcome'}>← Back</button>
      <h2>Create Account</h2>
      <p class="text-muted mb-3">Join the game!</p>

      {#if error}<p class="error">{error}</p>{/if}

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
          {loading ? 'Creating...' : 'Create Account'}
        </button>
      </form>
    {:else if mode === 'guest'}
      <button class="back-btn" on:click={() => mode = 'welcome'}>← Back</button>
      <h2>Play as Guest</h2>
      <p class="text-muted mb-3">No account needed!</p>

      {#if error}<p class="error">{error}</p>{/if}

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
        <button class="btn btn-primary w-full" disabled={loading}>
          {loading ? 'Joining...' : 'Join Lobby'}
        </button>
      </form>
      <p class="text-muted mt-2" style="font-size: 0.85rem;">
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
    background:
      radial-gradient(ellipse at center, var(--felt-light) 0%, var(--felt) 40%, var(--felt-dark) 100%);
  }

  .hero {
    text-align: center;
    margin-bottom: 40px;
  }

  .logo {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 15px;
    margin-bottom: 10px;
  }

  .logo-icon {
    font-size: 3rem;
    filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5));
  }

  .logo h1 {
    font-size: 3rem;
    text-shadow: 0 4px 8px rgba(0,0,0,0.5), 0 0 40px rgba(212,175,55,0.3);
    letter-spacing: 3px;
  }

  .tagline {
    color: rgba(255,255,255,0.7);
    font-size: 1.1rem;
  }

  .auth-card {
    width: 100%;
    max-width: 400px;
  }

  .auth-card h2 {
    text-align: center;
    margin-bottom: 8px;
  }

  .auth-options {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .divider {
    display: flex;
    align-items: center;
    gap: 16px;
    color: rgba(255,255,255,0.4);
    margin: 8px 0;
  }

  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgba(255,255,255,0.2);
  }

  .back-btn {
    background: none;
    border: none;
    color: rgba(255,255,255,0.6);
    cursor: pointer;
    font-size: 0.9rem;
    margin-bottom: 16px;
    padding: 0;
  }

  .back-btn:hover {
    color: white;
  }

  .error {
    color: #ef5350;
    background: rgba(239,83,80,0.1);
    padding: 10px 16px;
    border-radius: 8px;
    margin-bottom: 16px;
    font-size: 0.9rem;
  }

  .success-message {
    text-align: center;
    padding: 20px;
  }

  .success-message span {
    font-size: 3rem;
    display: block;
    margin-bottom: 16px;
  }

  .success-message p {
    color: rgba(255,255,255,0.8);
    margin-bottom: 24px;
  }
</style>
