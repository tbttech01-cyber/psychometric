const QuestionType = require('../models/QuestionType');
const BusinessMatrixCell = require('../models/BusinessMatrixCell');

exports.getMatrix = async (req, res, next) => {
  try {
    const types = await QuestionType.find({ isActive: true }).sort({ order: 1 });
    const cells = await BusinessMatrixCell.find();
    const total = types.length * types.length;
    const configured = cells.filter((c) => c.isActive).length;
    res.json({ success: true, types, cells, completion: { configured, total } });
  } catch (err) { next(err); }
};

exports.createCell = async (req, res, next) => {
  try {
    const { rowTypeId, colTypeId, businessName, rating } = req.body;
    const existing = await BusinessMatrixCell.findOne({ rowTypeId, colTypeId });
    if (existing) return res.status(409).json({ success: false, message: 'This cell is already configured. Edit it instead.' });
    const cell = await BusinessMatrixCell.create({ rowTypeId, colTypeId, businessName, rating });
    res.status(201).json({ success: true, data: cell });
  } catch (err) { next(err); }
};

exports.updateCell = async (req, res, next) => {
  try {
    const { businessName, rating, isActive } = req.body;
    const cell = await BusinessMatrixCell.findByIdAndUpdate(
      req.params.id,
      { ...(businessName !== undefined && { businessName }), ...(rating !== undefined && { rating }), ...(isActive !== undefined && { isActive }) },
      { new: true, runValidators: true }
    );
    if (!cell) return res.status(404).json({ success: false, message: 'Cell not found.' });
    res.json({ success: true, data: cell });
  } catch (err) { next(err); }
};

exports.deleteCell = async (req, res, next) => {
  try {
    const cell = await BusinessMatrixCell.findByIdAndDelete(req.params.id);
    if (!cell) return res.status(404).json({ success: false, message: 'Cell not found.' });
    res.json({ success: true, message: 'Cell removed.' });
  } catch (err) { next(err); }
};
