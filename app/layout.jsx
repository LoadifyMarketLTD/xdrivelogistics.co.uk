// app/layout.jsx
import '../styles/globals.css'
import Header from '../components/header'
import Footer from '../components/footer'

export const metadata = {
  title: 'XDrive Logistics — Danny Courier LTD',
  description:
    'Fast, reliable courier & logistics solutions across the UK. Same-day, next-day and dedicated deliveries by XDrive Logistics, operated by Danny Courier LTD.',
  metadataBase: new URL('https://xdrivelogistics.co.uk'),
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  // Google Search Console verification code should be added here when available
  // verification: {
  //   google: 'your-google-verification-code',
  // },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
      </head>
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  )
}
