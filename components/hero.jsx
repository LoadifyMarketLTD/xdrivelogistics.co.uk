export default function Hero({ children }) {
  return (
    <section className="hero" aria-hidden={false}>
      <div style={{maxWidth:720, margin:'0 auto'}}>
        <h1 style={{fontSize: '2.25rem', marginBottom:8}}>XDrive Logistics</h1>
        <p className="tagline">Reliable courier & logistics solutions across the UK — Danny Courier LTD</p>
        <div style={{marginTop:18}}>
          <a className="cta" href="#contact">Get a Quote</a>
        </div>
        {children}
      </div>
    </section>
  )
}
