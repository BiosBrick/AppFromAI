import { useWindowDimensions } from 'react-native';

export type DeviceLayout = {
  isTablet: boolean;
  screenWidth: number;
  screenHeight: number;
  columns: number;
};

export function useDeviceLayout(): DeviceLayout {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  return {
    isTablet,
    screenWidth: width,
    screenHeight: height,
    columns: isTablet ? 2 : 1,
  };
}
