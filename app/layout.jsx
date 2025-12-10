// app/layout.jsx
import '../styles/globals.css'
import Header from '../components/header'
import Footer from '../components/footer'

export const metadata = {
  title: 'XDrive Logistics — Danny Courier LTD',
  description:
    'Fast, reliable courier & logistics solutions across the UK. Same-day, next-day and dedicated deliveries by XDrive Logistics, operated by Danny Courier LTD.',
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
