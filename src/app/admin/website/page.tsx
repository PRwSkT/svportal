import { redirect } from 'next/navigation';

export default function WebsiteAdminRedirect() {
  redirect('/admin/website/personnel');
}
