import { useEffect } from 'react';
import { router } from 'expo-router';
import {
  PrivacyConsentScreen,
  usePrivacyConsent,
} from '../src/privacy-consent';

export default function Privacy() {
  const { status } = usePrivacyConsent();

  useEffect(() => {
    if (status === 'accepted') router.replace('/');
  }, [status]);

  return <PrivacyConsentScreen />;
}
