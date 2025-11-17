import type { ReactNode } from 'react';

interface ProjectInfo {
  sysname: string;
  title: string;
  description: ReactNode;
  showButton: boolean;
}

export const quizInfoArray: ProjectInfo[] = [
  {
    sysname: 'lorem',
    title: 'Lorem Project',
    description: (
      <>
        <strong>Lorem ipsum dolor sit amet</strong>, consectetur adipiscing elit.
        <br />
        <br />
        <strong>Aliquam</strong> dignissim orci sed <strong>massa</strong> ultrices, a placerat{' '}
        <strong>nibh</strong> tristique.
        <br />
        <br />
        Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae;
        <strong> Integer</strong> vulputate, velit vel cursus varius, nisl urna tincidunt nunc, at
        tristique <strong>odio</strong> sapien vel lorem.
        <br />
        <br />
        <strong>Sed euismod</strong> magna et dolor imperdiet, vitae gravida ligula dictum. Donec
        dictum risus vitae ex <strong>malesuada</strong> porttitor.
      </>
    ),
    showButton: true,
  },
  {
    sysname: 'lorem',
    title: 'Lorem Project',
    description: (
      <>
        <strong>Lorem ipsum dolor sit amet</strong>, consectetur adipiscing elit.
        <br />
        <br />
        <strong>Aliquam</strong> dignissim orci sed <strong>massa</strong> ultrices, a placerat{' '}
        <strong>nibh</strong> tristique.
        <br />
        <br />
        Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae;
        <strong> Integer</strong> vulputate, velit vel cursus varius, nisl urna tincidunt nunc, at
        tristique <strong>odio</strong> sapien vel lorem.
        <br />
        <br />
        <strong>Sed euismod</strong> magna et dolor imperdiet, vitae gravida ligula dictum. Donec
        dictum risus vitae ex <strong>malesuada</strong> porttitor.
      </>
    ),
    showButton: false,
  },
];
