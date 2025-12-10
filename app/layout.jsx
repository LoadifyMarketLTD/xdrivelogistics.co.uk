import './globals.css'
import Header from '../components/header'
import Footer from '../components/footer'

export const metadata = {
  title: 'XDrive Logistics — Danny Courier LTD',
  description: 'Professional UK courier and logistics services',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  )
}
