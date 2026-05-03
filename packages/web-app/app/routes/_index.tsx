import type { Route } from './+types/_index';

export function meta({}: Route.MetaArgs) {
  return [{ title: '首页' }, { name: 'description', content: '欢迎访问 react-router v7 展示型应用' }];
}

export default function Home() {
  return (
    <div className="home-page">
      <h1>欢迎访问</h1>
      <p>这是一个基于 react-router v7 的展示型应用。</p>
    </div>
  );
}
