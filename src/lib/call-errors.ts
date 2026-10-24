export function callErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'Microphone access is blocked. Allow the microphone for this app in your browser or device settings, then try Unmute.';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'No microphone was found. Connect a microphone or headset, then try Unmute. You can still listen.';
  if (name === 'NotReadableError' || name === 'TrackStartError') return 'Your microphone is busy. Close other apps using it, then try Unmute.';
  return error instanceof Error ? error.message : 'The call could not connect. Check your connection and try again.';
}
