import { ThemedView } from '@/components/themed-view';
import * as ReactNative from 'react-native';

const NativeTVFocusGuideView = (ReactNative as any).TVFocusGuideView;

import { Platform } from 'react-native';

export const TVFocusGuideView = (props: any) => {
  if (!Platform.isTV) {
    return <ThemedView {...props} />;
  }
  return <NativeTVFocusGuideView {...props} />;
};
