import { webcrypto } from 'crypto';
import { TextDecoder, TextEncoder } from 'util';
import {
  sessionManager,
  encryptSessionData,
  decryptSessionData,
  getSessionItem,
  setSessionItem,
  removeSessionItem
} from '../session';

Object.defineProperty(globalThis, 'TextEncoder', { value: TextEncoder });
Object.defineProperty(globalThis, 'TextDecoder', { value: TextDecoder });

// Setup global crypto for Node environment
Object.defineProperty(globalThis, 'crypto', {
  value: webcrypto,
  configurable: true,
  writable: true
});
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'crypto', {
    value: webcrypto,
    configurable: true,
    writable: true
  });
}

describe('session encryption and management', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    sessionManager.clearCache();
    sessionManager.stopMonitoring();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('encryptSessionData and decryptSessionData encrypts and decrypts strings correctly', async () => {
    const originalText = 'my-super-secret-stellar-key';
    const encrypted = await encryptSessionData(originalText);
    
    // Encrypted string should be valid JSON and contain ciphertext and iv
    expect(encrypted).toContain('ciphertext');
    expect(encrypted).toContain('iv');
    expect(encrypted).not.toContain(originalText);

    const decrypted = await decryptSessionData(encrypted);
    expect(decrypted).toBe(originalText);
  });

  test('setSessionItem encrypts and getSessionItem decrypts correctly from localStorage', async () => {
    const key = 'test_key';
    const value = 'test_value';

    await setSessionItem(key, value);

    // Verify localStorage has encrypted value
    const rawLocalValue = localStorage.getItem(key);
    expect(rawLocalValue).not.toBeNull();
    expect(rawLocalValue).toContain('ciphertext');
    expect(rawLocalValue).not.toContain(value);

    // Verify getSessionItem successfully decrypts it
    const decrypted = await getSessionItem(key);
    expect(decrypted).toBe(value);
  });

  test('getSessionItem falls back to plain text for unencrypted legacy values', async () => {
    const key = 'legacy_key';
    const value = 'legacy_plaintext_value';

    // Store plaintext directly
    localStorage.setItem(key, value);

    // Verify getSessionItem returns the plaintext directly
    const retrieved = await getSessionItem(key);
    expect(retrieved).toBe(value);
  });

  test('removeSessionItem deletes key from localStorage', async () => {
    const key = 'delete_key';
    await setSessionItem(key, 'delete_me');
    expect(localStorage.getItem(key)).not.toBeNull();

    removeSessionItem(key);
    expect(localStorage.getItem(key)).toBeNull();
  });

  test('SessionManager notifies subscribers on logout', async () => {
    const logoutSpy = jest.fn();
    const unsubscribe = sessionManager.subscribe(logoutSpy);

    // Simulate idle timeout triggering notify
    await sessionManager.startMonitoring();
    
    // Directly run checkIdleTimeout with no last active timestamp
    // It should initialize it rather than log out immediately
    jest.advanceTimersByTime(10000);
    
    // Now trigger notify manually to verify subscriber
    (sessionManager as any).notifyLogout();

    expect(logoutSpy).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  test('SessionManager triggers logout after 15 minutes of inactivity', async () => {
    const logoutSpy = jest.fn();
    sessionManager.subscribe(logoutSpy);

    // Start monitoring (initializes last active key)
    await sessionManager.startMonitoring();
    jest.advanceTimersByTime(100);

    // Verify last active is initialized
    const lastActiveInitial = await getSessionItem('vero_wallet_last_active');
    expect(lastActiveInitial).not.toBeNull();

    // Fast forward 14 minutes (under 15m limit)
    await jest.advanceTimersByTimeAsync(14 * 60 * 1000);
    await sessionManager.checkIdleTimeout();
    expect(logoutSpy).not.toHaveBeenCalled();

    // Fast forward 2 more minutes (exceeds 15m limit)
    await jest.advanceTimersByTimeAsync(2 * 60 * 1000);
    await sessionManager.checkIdleTimeout();
    expect(logoutSpy).toHaveBeenCalled();
  });

  test('SessionManager activity reset updates last active timestamp', async () => {
    await sessionManager.startMonitoring();
    jest.advanceTimersByTime(100);

    const initialTimestampStr = await getSessionItem('vero_wallet_last_active');
    expect(initialTimestampStr).not.toBeNull();
    const initialTimestamp = parseInt(initialTimestampStr!, 10);

    // Throttle should prevent updating within 10 seconds
    await jest.advanceTimersByTimeAsync(5000);
    // Simulate activity event (scroll)
    window.dispatchEvent(new Event('scroll'));
    
    // Wait for the update promise if it is active (should be null since it's throttled)
    const update1 = (sessionManager as any).activeUpdatePromise;
    if (update1) await update1;

    const check1TimestampStr = await getSessionItem('vero_wallet_last_active');
    expect(parseInt(check1TimestampStr!, 10)).toBe(initialTimestamp);

    // Advancing past 10s throttle limit and simulating activity
    await jest.advanceTimersByTimeAsync(6000); // 11s total advanced
    window.dispatchEvent(new Event('click'));
    
    // Await any pending update promise to let it write to localStorage
    const update2 = (sessionManager as any).activeUpdatePromise;
    if (update2) await update2;

    const check2TimestampStr = await getSessionItem('vero_wallet_last_active');
    expect(parseInt(check2TimestampStr!, 10)).toBeGreaterThan(initialTimestamp);
  });
});
