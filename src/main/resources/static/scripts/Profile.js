let cropper;
const image = document.querySelector('.profile-picture');
const input = document.getElementById('profilePictureInput');
const uploadButton = document.getElementById('uploadButton');
const form = document.querySelector('form[enctype="multipart/form-data"]');

input.addEventListener('change', function(event) {
    const files = event.target.files;
    if (files && files.length > 0) {
        const reader = new FileReader();
        reader.onload = function(e) {
            image.src = e.target.result;
            if (cropper) {
                cropper.destroy();
            }
            cropper = new Cropper(image, {
                aspectRatio: 1,
                viewMode: 1,
            });
            uploadButton.style.display = 'block';
        };
        reader.readAsDataURL(files[0]);
    }
});

// Modify the form submit event to send the cropped image
form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    if (!cropper) {
        form.submit();
        return;
    }
    
    // Get the cropped canvas
    const canvas = cropper.getCroppedCanvas({
        width: 300,
        height: 300
    });
    
    if (!canvas) {
        form.submit();
        return;
    }
    
    // Convert canvas to blob
    canvas.toBlob(function(blob) {
        // Create a new FormData
        const formData = new FormData(form);
        
        // Replace the original file with the cropped version
        formData.set('profilePicture', blob, 'cropped-image.png');
        
        // Send the data to the server using fetch
        fetch(form.action, {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (response.ok) {
                window.location.href = '/user/profile';
            } else {
                throw new Error('Image upload failed');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to upload image: ' + error.message);
        });
    }, 'image/png');
}); 