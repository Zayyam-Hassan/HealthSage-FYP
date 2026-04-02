import { Redirect } from 'expo-router';
import { CenteredScreenLoader } from '@/src/shared/components/CenteredScreenLoader';
import { useAuth } from '@/src/features/auth/hooks/useAuth';

export default function RootIndex() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <CenteredScreenLoader />;
  }

  return <Redirect href={user ? '/(tabs)' : '/(auth)/login'} />;
}

