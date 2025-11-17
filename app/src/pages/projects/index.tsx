import { projectInfoArray } from '@/shared/assets/textFiles/projectsInfo';
import { ProjectCard } from '@/shared/ui';
import { Header } from '@/widgets';

import styles from './Projects.module.scss';

export const Projects = () => {
  return (
    <div>
      <Header />
      <div className={styles.projectGridContainer}>
        <div className={styles.projectsContainer}>
          {projectInfoArray.map((projectInfo, index) => (
            <ProjectCard
              key={index}
              title={projectInfo.title}
              description={projectInfo.description}
              sysname={projectInfo.sysname}
              showButton={projectInfo.showButton}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
