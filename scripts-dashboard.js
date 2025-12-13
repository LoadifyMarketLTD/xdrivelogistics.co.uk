// Minimal interactivity: date selector + view all
document.addEventListener('DOMContentLoaded', function(){
  const dateRange = document.getElementById('date-range');
  const from = document.getElementById('from-date');
  const to = document.getElementById('to-date');
  if(dateRange){
    dateRange.addEventListener('change', function(){
      if(this.value === 'today'){
        const d = new Date().toISOString().slice(0,10);
        from.value = d; to.value = d;
      } else if(this.value === 'custom'){
        from.focus();
      } else {
        // parse option value if a date is provided
        from.value = this.value;
      }
    });
  }

  const viewAll = document.getElementById('view-all');
  if(viewAll){
    viewAll.addEventListener('click', function(){ alert('Deschide lista completă de bookinguri (implementare server-side).'); });
  }

  const addWatch = document.getElementById('add-watch');
  if(addWatch){
    addWatch.addEventListener('click', function(){ alert('Adaugă membru la watchlist (implementare CRUD necesară).'); });
  }
});
