import { useEffect, useState } from 'react';
import { fetchFlavors, fetchImages } from '../api';

export default function ComputePage({ token, view }) {
  const [flavors, setFlavors] = useState([]);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        if (view === 'flavor') {
          const flavorsData = await fetchFlavors(token);
          if (mounted) {
            setFlavors(flavorsData || []);
          }
        } else {
          const imagesData = await fetchImages(token);
          if (mounted) {
            setImages(imagesData || []);
          }
        }
      } catch (e) {
        if (mounted) {
          setError(e.message || 'Khong the tai du lieu compute.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [token, view]);

  if (loading) {
    return <p>Dang tai compute...</p>;
  }

  if (error) {
    return <p className="error">{error}</p>;
  }

  return (
    <section>
      <h2>Compute</h2>

      {view === 'flavor' && (
        <>
          <h3>Flavors</h3>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
              </tr>
            </thead>
            <tbody>
              {flavors.map((flavor) => (
                <tr key={flavor.id}>
                  <td>{flavor.id}</td>
                  <td>{flavor.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {view === 'image' && (
        <>
          <h3>Images</h3>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
              </tr>
            </thead>
            <tbody>
              {images.map((image) => (
                <tr key={image.id}>
                  <td>{image.id}</td>
                  <td>{image.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
