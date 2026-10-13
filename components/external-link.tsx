import type { ReactNode } from 'react';
import { Linking, Platform, Pressable, Text } from 'react-native';

type Props = {
  href: string;
  children?: ReactNode;
  style?: object;
};

export function ExternalLink({ href, children, style }: Props) {
  const linkStyle = style ?? undefined;

  const handlePress = async () => {
    if (Platform.OS === 'web') {
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }

    await Linking.openURL(href);
  };

  return (
    <Pressable onPress={handlePress} style={linkStyle}>
      {children ?? <Text>{href}</Text>}
    </Pressable>
  );
}
