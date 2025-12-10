import '../styles/globals.css'
import { Header } from '../components/header'
import { Footer } from '../components/footer'

export const metadata = {
  title: 'XDrive Logistics — Danny Courier LTD',
  description: 'Courier and logistics services across the UK — XDrive Logistics'
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main className="container">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
