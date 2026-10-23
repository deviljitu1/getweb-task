import { useEffect, useState } from 'react';
import { Bell, BellOff, Volume2, VolumeX, Mic, Smartphone, Send } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  getNotificationPrefs,
  setNotificationPrefs,
  subscribeNotificationPrefs,
  type NotificationPrefs,
} from '@/lib/notifications';
import { requestNotificationPermissions, showNativeNotification, syncReminderPreferences } from '@/lib/pushNotifications';
import { stopSpeaking } from '@/lib/voice';
import { toast } from '@/hooks/use-toast';

const NotificationSettings = () => {
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => getNotificationPrefs());

  useEffect(() => subscribeNotificationPrefs(setPrefs), []);

  const toggle = async (key: keyof NotificationPrefs) => {
    const next = setNotificationPrefs({ [key]: !prefs[key] });
    if (key === 'voiceEnabled' && !next.voiceEnabled) stopSpeaking();
    if (key === 'remindersEnabled') {
      if (next.remindersEnabled) await requestNotificationPermissions();
      await syncReminderPreferences();
    }
  };

  const handleTestNotification = async () => {
    if (!prefs.remindersEnabled) {
      toast({ title: 'Reminders are off', description: 'Enable task reminders before testing notifications.' });
      return;
    }
    if (!await requestNotificationPermissions()) {
      toast({ title: 'Notifications are blocked', description: 'Allow notifications in your device or browser settings.' });
      return;
    }
    const sent = await showNativeNotification({
      title: 'GetWebApp notification test',
      body: 'This is a test notification from your workspace.',
      data: { link_url: '/' },
    });
    toast({
      title: sent ? 'Test notification requested' : 'Notification unavailable',
      description: sent ? 'Check your device notification area.' : 'Your device could not display the notification.',
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full text-muted-foreground hover:text-foreground"
          title="Notification settings"
          aria-label="Notification settings"
        >
          {prefs.remindersEnabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); toggle('remindersEnabled'); }}>
          {prefs.remindersEnabled ? <Bell className="h-4 w-4 mr-2" /> : <BellOff className="h-4 w-4 mr-2" />}
          <span className="flex-1">Task reminders</span>
          <span className="text-xs text-muted-foreground">{prefs.remindersEnabled ? 'On' : 'Off'}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); toggle('soundEnabled'); }}>
          {prefs.soundEnabled ? <Volume2 className="h-4 w-4 mr-2" /> : <VolumeX className="h-4 w-4 mr-2" />}
          <span className="flex-1">Notification sound</span>
          <span className="text-xs text-muted-foreground">{prefs.soundEnabled ? 'On' : 'Off'}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); toggle('voiceEnabled'); }}>
          <Mic className="h-4 w-4 mr-2" />
          <span className="flex-1">AI voice replies</span>
          <span className="text-xs text-muted-foreground">{prefs.voiceEnabled ? 'On' : 'Off'}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleTestNotification} className="cursor-pointer text-primary focus:text-primary font-medium">
          <Send className="h-4 w-4 mr-2" />
          <span className="flex-1">Test Notification</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationSettings;
