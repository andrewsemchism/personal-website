import React, { useState  } from 'react';
import './styles.css';

interface Props {
  imageUrl: string;
  title: string;
  description: string;
  link: string;
}

const ImageComponent: React.FC<Props> = ({ imageUrl, title, description, link }) => {
  const [mouseOver, setMouseOver] = useState<'image' | 'overlay' | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);

  const handleImageMouseEnter = () => {
    setMouseOver('image');
    setShowOverlay(true);
  };

  const handleImageMouseLeave = () => {
    if (mouseOver !== 'overlay') {
      setShowOverlay(false);
    }
  };

  const handleOverlayMouseEnter = () => {
    setMouseOver('overlay');
    setShowOverlay(true);
  };

  const handleOverlayMouseLeave = () => {
    setShowOverlay(false);
  };

  return (
    <a href={link} target="_blank">
      <div className="image-container">
        <img
          className={`image ${showOverlay ? 'darkened' : ''}`}
          src={imageUrl}
          alt={title}
          onMouseEnter={handleImageMouseEnter}
          onMouseLeave={handleImageMouseLeave}
        />
        {showOverlay && (
          <div className="overlay" onMouseEnter={handleOverlayMouseEnter} onMouseLeave={handleOverlayMouseLeave}>
            <h3 className="title">{title}</h3>
            <p className="description">{description}</p>
          </div>
        )}
      </div>
    </a>
  );
};

export default ImageComponent;