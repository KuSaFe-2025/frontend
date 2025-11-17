import logo from './mtuci.svg';

type MTUCIIconProps = React.SVGProps<SVGSVGElement> & {
  size?: number;
};

export const MTUCIIcon = ({ size = 24 }: MTUCIIconProps) => (
  <img src={logo} width={size} height={size} />
);
