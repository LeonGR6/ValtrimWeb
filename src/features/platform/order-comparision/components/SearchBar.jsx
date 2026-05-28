export default function SearchBar({
  search,
  setSearch,
}) {
  return (
    <div className="search-container">

      <input
        type="text"
        placeholder="Search requests..."
        value={search}
        onChange={(e) =>
          setSearch(e.target.value)
        }
        className="search-input"
      />

    </div>
  );
}