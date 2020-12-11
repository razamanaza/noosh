window.onload = function() {

  if (window.location.hash == '#thanks') {
    $('#modal-thanks').modal('show')
  }

  $('#modal-thanks').on('hidden.bs.modal', function (e) {
    window.location = '/';
  });

  $(".owl-carousel").owlCarousel({
    items: 1,
  });

  $('[data-fancybox="gallery"]').fancybox({
      infobar: false,
      arrows: false,
      toolbar: true,
      buttons: [
        "close"
      ]
  });

};
