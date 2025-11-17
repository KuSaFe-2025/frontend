import type { ReactNode } from 'react';

interface ProjectInfo {
  sysname: string;
  title: string;
  description: ReactNode;
  showButton: boolean;
}

export const projectInfoArray: ProjectInfo[] = [
  {
    sysname: 'shield',
    title: 'WinShield',
    description: (
      <>
        <strong>Собственный сервер</strong> в <strong>Амстердаме</strong>&nbsp;c&nbsp;
        <strong>безопасным</strong> подключением.
        <br />
        <br />
        <strong>Безопасность</strong> соединения обеспечивает протокол{' '}
        <strong>VLESS TCP REALITY</strong>.
        <br />
        <br />
        <strong>Этот</strong> сервис позволит вам использовать <strong>все</strong> привычные
        ресурсы, к которым у вас <strong>пропал доступ,</strong> по <strong>приятной</strong> цене.
        <br />
        <br />
        <strong>Стало интересно?</strong> <strong>Свяжитесь со мной</strong> через форму на{' '}
        <strong>главной странице </strong> или нажав кнопку ниже, если у вас есть{' '}
        <strong>Telegram.</strong>
      </>
    ),
    showButton: true,
  },
  {
    sysname: 'web',
    title: 'Сайт kusafe.ru',
    description: (
      <>
        <strong>Персональный сайт-портфолио</strong> с возможностью публикации постов.
        <br />
        <br />
        <strong>Frontend</strong> реализован на <strong>React</strong> и <strong>Chakra UI</strong>.
        <br />
        <br />
        <strong>Backend</strong> на <strong>Express.js</strong>.
      </>
    ),
    showButton: false,
  },
];
