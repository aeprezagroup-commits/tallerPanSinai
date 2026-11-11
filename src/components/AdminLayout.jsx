import { Outlet } from 'react-router-dom';

export default function AdminLayout() {
  return (
    <div className="animate-fade-in">
      <Outlet />
    </div>
  );
}
