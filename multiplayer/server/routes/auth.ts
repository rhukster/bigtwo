import { Router } from 'express';
import { nanoid } from 'nanoid';
import {
  createUser,
  getUserByEmail,
  getUserById,
  createMagicLink,
  verifyMagicLink,
  createSession,
  getSession,
  deleteSession,
  getUserByUsername
} from '../db/index.ts';
import { sendMagicLinkEmail } from '../utils/email.ts';

const router = Router();

// Check if username is available
router.get('/check-username/:username', (req, res) => {
  const { username } = req.params;

  if (!username || username.length < 2 || username.length > 20) {
    return res.json({ available: false, error: 'Username must be 2-20 characters' });
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return res.json({ available: false, error: 'Username can only contain letters, numbers, - and _' });
  }

  const existing = getUserByUsername(username);
  res.json({ available: !existing });
});

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, email } = req.body;

    if (!username || !email) {
      return res.status(400).json({ error: 'Username and email required' });
    }

    // Validate username
    if (username.length < 2 || username.length > 20) {
      return res.status(400).json({ error: 'Username must be 2-20 characters' });
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, - and _' });
    }

    // Validate email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if email exists
    const existingEmail = getUserByEmail(email);
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Check if username exists
    const existingUsername = getUserByUsername(username);
    if (existingUsername) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Create user
    const userId = createUser(username, email);

    // Create magic link
    const token = createMagicLink(userId);

    // Send email
    const success = await sendMagicLinkEmail(email, username, token);
    if (!success) {
      return res.status(500).json({ error: 'Failed to send email. Please try again.' });
    }

    res.json({ success: true, message: 'Check your email for a login link!' });
  } catch (error) {
    console.error('[Auth] Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Request login link
router.post('/login', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const user = getUserByEmail(email);
    if (!user) {
      // Don't reveal if email exists
      return res.json({ success: true, message: 'If an account exists, a login link was sent!' });
    }

    // Create magic link
    const token = createMagicLink(user.id);

    // Send email
    const success = await sendMagicLinkEmail(email, user.username, token);
    if (!success) {
      return res.status(500).json({ error: 'Failed to send email. Please try again.' });
    }

    res.json({ success: true, message: 'Check your email for a login link!' });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Verify magic link
router.get('/verify', (req, res) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Invalid token' });
    }

    const userId = verifyMagicLink(token);
    if (!userId) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const user = getUserById(userId);
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    // Create session
    const sessionId = createSession(userId);

    // Set session cookie
    res.cookie('session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'lax'
    });

    // Redirect to app
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.redirect(`${clientUrl}/lobby?welcome=true`);
  } catch (error) {
    console.error('[Auth] Verify error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Get current user
router.get('/me', (req, res) => {
  const sessionId = req.cookies?.session;

  if (!sessionId) {
    return res.json({ user: null });
  }

  const session = getSession(sessionId);
  if (!session) {
    res.clearCookie('session');
    return res.json({ user: null });
  }

  res.json({
    user: {
      id: session.user_id,
      username: session.username,
      email: session.email,
      isGuest: false
    }
  });
});

// Logout
router.post('/logout', (req, res) => {
  const sessionId = req.cookies?.session;

  if (sessionId) {
    deleteSession(sessionId);
    res.clearCookie('session');
  }

  res.json({ success: true });
});

// Create guest account
router.post('/guest', (req, res) => {
  const { name } = req.body;

  if (!name || name.length < 2 || name.length > 20) {
    return res.status(400).json({ error: 'Name must be 2-20 characters' });
  }

  // Create a temporary guest ID
  const guestId = `guest-${nanoid(8)}`;

  res.json({
    user: {
      id: guestId,
      username: name,
      email: null,
      isGuest: true
    }
  });
});

export default router;
