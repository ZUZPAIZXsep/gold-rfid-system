exports.getGoldHistory = async (req, res, next) => {
    try {
      const { start_date, end_date, select_goldType, select_goldSize, gold_id, page = 1, limit = 10 } = req.query;
      
      const query = {};
      if (start_date && end_date) {
        query.gold_Datetime = {
          $gte: new Date(start_date),
          $lte: new Date(end_date)
        };
      }
      if (select_goldType) query.gold_type = select_goldType;
      if (select_goldSize) query.gold_size = select_goldSize;
      if (gold_id) query.gold_id = gold_id;
  
      const skip = (page - 1) * limit;
      const [data, total] = await Promise.all([
        Goldhistory.find(query).sort({ gold_Datetime: -1 }).skip(skip).limit(Number(limit)),
        Goldhistory.countDocuments(query)
      ]);
  
      const totalPages = Math.ceil(total / limit);
      const summarizedGoldHistory = summarizeGoldHistory(data);
  
      res.render('gold_history', {
        summarizedGoldHistory,
        startDate: start_date || '',
        endDate: end_date || '',
        select_goldType: select_goldType || '',
        select_goldSize: select_goldSize || '',
        gold_id: gold_id || '',
        currentPage: Number(page),
        totalPages: totalPages,
        queryParams: new URLSearchParams(req.query).toString()
      });
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  };
  
  function summarizeGoldHistory(data) {
    const summary = data.reduce((acc, record) => {
      const date = dayjs(record.gold_Datetime).startOf('day').format('YYYY-MM-DD');
      if (!acc[date]) {
        acc[date] = { date: date, count: 0 };
      }
      acc[date].count += 1;
      return acc;
    }, {});
  
    return Object.values(summary);
  }
  