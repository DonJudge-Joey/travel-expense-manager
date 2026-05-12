import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '差旅费用管理',
    template: '%s | 差旅费用管理',
  },
  description:
    '多人差旅预算管理，支持实时汇率转换，自动扣减预算',
  keywords: [
    '差旅费用',
    '预算管理',
    '汇率转换',
    '费用报销',
    '出差管理',
  ],
  authors: [{ name: 'Travel Expense Team' }],
  generator: 'Coze Code',
  // icons: {
  //   icon: '',
  // },
  openGraph: {
    title: '差旅费用管理',
    description: '多人差旅预算管理，支持实时汇率转换，自动扣减预算',
    siteName: '差旅费用管理',
    locale: 'zh_CN',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`antialiased`} suppressHydrationWarning>
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
