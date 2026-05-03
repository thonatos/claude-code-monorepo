import type { Route } from './+types/about';

export function meta({}: Route.MetaArgs) {
  return [{ title: '关于' }, { name: 'description', content: '关于 react-router v7 文件路由' }];
}

export default function About() {
  return (
    <div className="about-page">
      <h1>关于</h1>
      <p>这是一个使用 react-router v7 文件路由的应用。</p>
      <p>路由由 `app/routes/` 目录下的文件自动生成。</p>
    </div>
  );
}
