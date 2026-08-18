import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';

// Register font
Font.register({
  family: 'Arial',
  fonts: [
    { src: '/fonts/arial.ttf', fontWeight: 'normal' },
    { src: '/fonts/arialbd.ttf', fontWeight: 'bold' }
  ]
});

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Arial',
    backgroundColor: '#ffffff',
    width: '100%',
    height: '100%',
    padding: 0,
  },
  catalogPage: {
    width: 595,
    height: 842,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 24px',
    borderBottomWidth: 1,
    borderBottomColor: '#1a4a6e',
    backgroundColor: '#1a4a6e',
  },
  catNameAr: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  catNameEn: {
    color: '#a8cce4',
    fontSize: 12,
  },
  productCard: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: 24,
  },
  imageSection: {
    width: 320,
    height: 240,
    marginBottom: 20,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f4f6f8',
    borderRadius: 8,
    overflow: 'hidden'
  },
  image: {
    objectFit: 'contain',
    width: '100%',
    height: '100%',
  },
  titleAr: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a4a6e',
    textAlign: 'center',
    marginBottom: 8,
  },
  titleEnWrapper: {
    backgroundColor: '#f4f6f8',
    padding: '4px 16px',
    borderRadius: 20,
    marginBottom: 20,
  },
  titleEn: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  description: {
    width: '100%',
    display: 'flex',
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 30,
    padding: 16,
    backgroundColor: '#f6f9fc',
    borderRadius: 8,
  },
  descText: {
    flex: 1,
    fontSize: 12,
    color: '#333333',
    lineHeight: 1.6,
    textAlign: 'right',
  },
  detailsGrid: {
    width: '100%',
    display: 'flex',
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
    justifyContent: 'center'
  },
  detailItem: {
    width: '30%',
    backgroundColor: '#f9fbfd',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e6ed',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  detailLabel: {
    fontSize: 10,
    color: '#666666',
    marginBottom: 6,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a4a6e',
    textAlign: 'right'
  },
  barcodeItem: {
    width: '100%',
    alignItems: 'center',
  },
  barcodeValue: {
    fontSize: 14,
    color: '#333333',
    letterSpacing: 2,
    marginTop: 4,
  },
  footer: {
    marginTop: 'auto',
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#e0e6ed',
    paddingTop: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  footerNote: {
    fontSize: 11,
    color: '#666666',
    backgroundColor: '#f4f6f8',
    padding: '6px 16px',
    borderRadius: 20,
  },
  emptyField: {
    color: '#999999',
  }
});

const PdfDocument = ({ productsToRender, visibility, footerText, visibleTableFields }) => {
  return (
    <Document>
      {productsToRender.map((prod, index) => {
        const hasDescription = (visibility.descAr && prod.descAr) || (visibility.descEn && prod.descEn);

        return (
          <Page key={index} size="A4" style={styles.page}>
            <View style={styles.catalogPage}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.catNameAr}>
                  {prod.categoryAr || 'التصنيف'}
                </Text>
                <Text style={styles.catNameEn}>
                  {prod.categoryEn || 'CATEGORY'}
                </Text>
              </View>

              {/* Product Card */}
              <View style={styles.productCard}>
                
                {/* Image */}
                {visibility.image && (
                  <View style={styles.imageSection}>
                    {prod.imagePreview ? (
                      <Image src={prod.imagePreview} style={styles.image} />
                    ) : (
                      <Text style={styles.emptyField}>صورة المنتج</Text>
                    )}
                  </View>
                )}

                {/* Product Name AR */}
                {visibility.nameAr && (
                  <Text style={styles.titleAr}>
                    {prod.nameAr || 'اسم المنتج بالعربي'}
                  </Text>
                )}

                {/* Product Name EN */}
                {visibility.nameEn && (
                  <View style={styles.titleEnWrapper}>
                    <Text style={styles.titleEn}>
                      {prod.nameEn || 'Product Name in English'}
                    </Text>
                  </View>
                )}

                {/* Description */}
                {hasDescription && (
                  <View style={styles.description}>
                    {visibility.descAr && (
                      <Text style={styles.descText}>
                        {prod.descAr || 'وصف المنتج بالعربي'}
                      </Text>
                    )}
                    {visibility.descEn && (
                      <Text style={[styles.descText, { textAlign: 'left' }]}>
                        {prod.descEn || 'Product description in English'}
                      </Text>
                    )}
                  </View>
                )}

                {/* Info Grid */}
                {(visibleTableFields.length > 0 || visibility.barcode) && (
                  <View style={styles.detailsGrid}>
                    {visibleTableFields.map(f => (
                      <View key={f.key} style={styles.detailItem}>
                        <Text style={styles.detailLabel}>{f.label}</Text>
                        <Text style={styles.detailValue}>
                          {f.key === 'weight'
                            ? (prod.weight
                              ? `${prod.weight}${visibility.unit && prod.unit ? ' ' + prod.unit : ''}`
                              : '-')
                            : (prod[f.key] || '-')}
                        </Text>
                      </View>
                    ))}

                    {visibility.barcode && (
                      <View style={[styles.detailItem, styles.barcodeItem]}>
                        <Text style={styles.detailLabel}>باركود</Text>
                        <Text style={styles.barcodeValue}>
                          {prod.barcode || '-'}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Footer */}
                {footerText && (
                  <View style={styles.footer}>
                    <Text style={styles.footerNote}>{footerText}</Text>
                  </View>
                )}
              </View>
            </View>
          </Page>
        );
      })}
    </Document>
  );
};

export default PdfDocument;
