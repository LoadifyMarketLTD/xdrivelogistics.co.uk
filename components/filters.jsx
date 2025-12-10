export default function Filters({ filters, onChange }) {
  const updateField = (field) => (event) => {
    onChange({
      ...filters,
      [field]: event.target.value,
    });
  };

  const clearFilters = () => {
    onChange({
      vehicleType: 'all',
      maxDistance: '',
      minPrice: '',
      maxPrice: '',
      search: '',
    });
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[1.5fr_repeat(3,minmax(0,1fr))] md:items-end">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">
            Search (route, ref)
          </label>
          <input
            type="text"
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            placeholder="e.g. London, M25, REF123"
            value={filters.search}
            onChange={updateField('search')}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">
            Vehicle
          </label>
          <select
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            value={filters.vehicleType}
            onChange={updateField('vehicleType')}
          >
            <option value="all">Any</option>
            <option value="small-van">Small van</option>
            <option value="luton">Luton</option>
            <option value="xlwb">XLWB</option>
            <option value="7.5t">7.5T</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">
            Max distance (km)
          </label>
          <input
            type="number"
            min="0"
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            placeholder="e.g. 300"
            value={filters.maxDistance}
            onChange={updateField('maxDistance')}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">
            Price range (&pound;)
          </label>
          <div className="flex gap-1">
            <input
              type="number"
              min="0"
              className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              placeholder="Min"
              value={filters.minPrice}
              onChange={updateField('minPrice')}
            />
            <input
              type="number"
              min="0"
              className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              placeholder="Max"
              value={filters.maxPrice}
              onChange={updateField('maxPrice')}
            />
          </div>
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={clearFilters}
          className="text-xs font-medium text-slate-500 hover:text-slate-700"
        >
          Clear filters
        </button>
      </div>
    </section>
  );
}
