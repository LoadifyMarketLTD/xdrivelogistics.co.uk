export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="company-info">
        <strong>Danny Courier LTD</strong><br />
        101 Cornelian Street, Blackburn, BB1 9QL, UK
      </div>
      <div className="legal">
        <small>© {new Date().getFullYear()} XDrive Logistics. All rights reserved.</small>
      </div>
    </footer>
  )
}
